"""
Generate MP3 + word-level VTT using edge-tts WordBoundary events.

Usage: python edge-tts-words.py <text_file> <voice> <rate> <pitch> <mp3_out> <vtt_out>
"""
import asyncio
import sys
import edge_tts


async def main() -> None:
    text_file, voice, rate, pitch, mp3_out, vtt_out = sys.argv[1:7]

    with open(text_file, "r", encoding="utf-8") as f:
        text = f.read().strip()

    communicate = edge_tts.Communicate(
        text, voice, rate=rate, pitch=pitch, boundary="WordBoundary"
    )
    submaker = edge_tts.SubMaker()

    with open(mp3_out, "wb") as mp3_file:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                mp3_file.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                submaker.feed(chunk)

    # SubMaker outputs SRT format (commas for ms); parseVtt.ts handles both , and .
    vtt_content = "WEBVTT\n\n" + submaker.get_srt()
    with open(vtt_out, "w", encoding="utf-8") as f:
        f.write(vtt_content)


asyncio.run(main())
