"""
Generate MP3 + word-level VTT using edge-tts WordBoundary events.
Original word text (with punctuation) is used instead of the stripped
boundary text, so subtitles show "Hello!" not "Hello".

Usage: python edge-tts-words.py <text_file> <voice> <rate> <pitch> <mp3_out> <vtt_out>
"""
import asyncio
import sys
from datetime import timedelta
import edge_tts


def fmt_ts(td: timedelta) -> str:
    total_ms = int(td.total_seconds() * 1000)
    ms = total_ms % 1000
    s = (total_ms // 1000) % 60
    m = (total_ms // 60000) % 60
    h = total_ms // 3600000
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


async def main() -> None:
    text_file, voice, rate, pitch, mp3_out, vtt_out = sys.argv[1:7]

    with open(text_file, "r", encoding="utf-8-sig") as f:
        text = f.read().strip()

    original_words = text.split()

    communicate = edge_tts.Communicate(
        text, voice, rate=rate, pitch=pitch, boundary="WordBoundary"
    )

    audio_chunks = []
    word_events = []

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            word_events.append(chunk)

    with open(mp3_out, "wb") as f:
        for data in audio_chunks:
            f.write(data)

    # Pair original words (punctuation intact) with boundary timings.
    # Fall back to event text if counts diverge (e.g. unusual contractions).
    pairs = []
    for i, event in enumerate(word_events):
        word = original_words[i] if i < len(original_words) else event["text"]
        start = timedelta(microseconds=event["offset"] / 10)
        end   = timedelta(microseconds=(event["offset"] + event["duration"]) / 10)
        pairs.append((word, start, end))

    lines = ["WEBVTT", ""]
    for i, (word, start, end) in enumerate(pairs, 1):
        lines += [str(i), f"{fmt_ts(start)} --> {fmt_ts(end)}", word, ""]

    with open(vtt_out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


asyncio.run(main())
