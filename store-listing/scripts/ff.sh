#!/usr/bin/env bash
# ffmpeg recipes for store listings: review recordings, grab stills, make App Store app previews.
# Run without arguments for the list.
set -euo pipefail

FF=(ffmpeg -hide_banner -loglevel error -nostats -y)

usage() {
  cat <<'USAGE'
ff.sh <command> ...

  probe    <in>                                 duration, size, fps, audio? (JSON)
  frames   <in> <outdir> [count=9]              evenly spaced frames + contact_sheet.png (review a recording)
  still    <in> <out.png> <time>                one full-resolution frame, e.g. the best gameplay moment
                                                (save it as captures/<device>/<name>.png to use it in a design)
  preview  <in> <out.mp4> [size=iphone] [pad]   App Store app preview: exact size, 30 fps, H.264 High 4.0
                                                ~11 Mbps, stereo AAC 256k (silent track if none), trimmed to
                                                30 s or frozen up to 15 s.
                                                size: iphone (886x1920), iphone-landscape (1920x886),
                                                      ipad (1200x1600), ipad-landscape (1600x1200)
                                                pad:  omit to cover-crop; a colour (e.g. "#ffffff") to fit the
                                                      whole capture and fill the gap at the top with it (the
                                                      status-bar strip of UI captures)
  music    <video> <audio> <out.mp4> [vol=0.8]  replace the soundtrack, trimmed and faded to the video length
USAGE
}

need() { [[ $# -ge $1 ]] || { usage; exit 64; }; }
dur() { ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$1"; }

cmd="${1:-}"; shift || true
case "$cmd" in
  probe)
    need 1 "$@"
    ffprobe -v error -show_entries format=duration:stream=codec_type,width,height,r_frame_rate -of json "$1" | node -e '
      const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
      const v = (j.streams || []).find((s) => s.codec_type === "video") || {};
      const [a, b] = String(v.r_frame_rate || "0/1").split("/").map(Number);
      console.log(JSON.stringify({ duration: Number(j.format?.duration) || null, width: v.width ?? null, height: v.height ?? null,
        fps: b ? Math.round((a / b) * 100) / 100 : null, audio: (j.streams || []).some((s) => s.codec_type === "audio") }));' ;;
  frames)
    need 2 "$@"; n="${3:-9}"; mkdir -p "$2"; rm -f "$2"/frame_*.png "$2/contact_sheet.png"
    d=$(dur "$1")
    for i in $(seq 0 $((n - 1))); do
      t=$(awk -v d="$d" -v i="$i" -v n="$n" 'BEGIN{printf "%.2f", d*(i+0.5)/n}')
      ffmpeg -hide_banner -loglevel error -y -ss "$t" -i "$1" -frames:v 1 -vf "scale=480:-2" "$2/frame_$(printf %02d "$i")_${t}s.png"
    done
    cols=3; rows=$(( (n + cols - 1) / cols ))
    ffmpeg -hide_banner -loglevel error -y -pattern_type glob -i "$2/frame_*.png" -vf "tile=${cols}x${rows}:padding=6:color=black" -frames:v 1 "$2/contact_sheet.png"
    echo "$2/contact_sheet.png" ;;
  still)
    need 3 "$@"; mkdir -p "$(dirname "$2")"
    "${FF[@]}" -ss "$3" -i "$1" -frames:v 1 "$2"; echo "$2" ;;
  preview)
    need 2 "$@"; size="${3:-iphone}"; pad="${4:-}"
    case "$size" in
      iphone) w=886; h=1920 ;; iphone-landscape) w=1920; h=886 ;;
      ipad) w=1200; h=1600 ;; ipad-landscape) w=1600; h=1200 ;;
      *) echo "unknown size: $size" >&2; exit 64 ;;
    esac
    d=$(dur "$1")
    if [[ -n "$pad" ]]; then
      geo="scale=$w:$h:force_original_aspect_ratio=decrease,pad=$w:$h:(ow-iw)/2:oh-ih:color=$pad"
    else
      geo="scale=$w:$h:force_original_aspect_ratio=increase,crop=$w:$h"
    fi
    # App previews must run 15-30 s: hold the last frame of short clips, cut long ones.
    hold=$(awk -v d="$d" 'BEGIN{x=15.2-d; if(x<0)x=0; printf "%.2f", x}')
    vf="$geo,fps=30,setsar=1,tpad=stop_mode=clone:stop_duration=$hold,format=yuv420p"
    venc=(-c:v libx264 -preset slow -profile:v high -level 4.0 -b:v 11M -maxrate 12M -bufsize 24M -movflags +faststart)
    hasA=$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$1" | sed -n 1p || true)
    if [[ -n "$hasA" ]]; then
      "${FF[@]}" -i "$1" -t 30 -vf "$vf" "${venc[@]}" -af "apad" -c:a aac -b:a 256k -ar 44100 -ac 2 -shortest "$2"
    else
      "${FF[@]}" -i "$1" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t 30 -vf "$vf" "${venc[@]}" \
        -map 0:v -map 1:a -c:a aac -b:a 256k -shortest "$2"
    fi
    "$0" probe "$2" ;;
  music)
    need 3 "$@"; vol="${4:-0.8}"
    d=$(dur "$1"); st=$(awk -v d="$d" 'BEGIN{s=d-2; if(s<0)s=0; printf "%.3f", s}')
    "${FF[@]}" -i "$1" -stream_loop -1 -i "$2" -filter_complex \
      "[1:a]atrim=0:$d,asetpts=PTS-STARTPTS,volume=$vol,afade=t=in:d=0.4,afade=t=out:st=$st:d=2,aformat=channel_layouts=stereo[a]" \
      -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -ar 44100 -shortest -movflags +faststart "$3" ;;
  ""|-h|--help|help) usage ;;
  *) echo "unknown command: $cmd" >&2; usage; exit 64 ;;
esac
