# Lumina: Fashion, Described

## Inspiration

Buying clothes is an intensely visual act—from checking if navy is really navy to squinting at a tiny care tag. For the 2.2 billion people worldwide living with vision impairment, that quietly removes the freedom to shop independently. We wanted to build a tool that didn't just clinically identify clothes, but actively helped users style them.

## What it does

Point your camera at a garment, and Lumina speaks a rich description covering:

- **The basics:** Silhouette, fabric texture, color, and pattern.
- **The details:** Care tag text and washing instructions.
- **The styling:** An AI-generated outfit pairing suggestion (e.g., *"Pair this navy knit with light beige chinos"*).

If the AI isn't quite enough, a single, high-contrast button connects the user to a human shopping assistant via a live audio/video call.

## How we built it

We built a lightweight, accessible web app that requires zero downloads or installations. We used the **Google Gemini Vision API** for rapid visual analysis of the clothing, **Vonage APIs** to handle the live camera feed and human-assist calls, and the browser's **native text-to-speech** to read descriptions aloud instantly.

## Challenges we ran into

- **AI Hallucinations:** Early on, if the camera view was dark or blurry, the AI would confidently invent an outfit description. For an accessibility tool, this is dangerous. We had to strictly train the AI to admit when it couldn't see something clearly and ask the user to adjust the camera.
- **Audio Clutter:** We had to carefully engineer the audio pacing so our app's voice didn't talk over the native screen readers (like VoiceOver or TalkBack) that our users already have running on their phones.
- **Pacing the Experience:** Initially, the app scanned the camera continuously, which was overwhelming to listen to and quickly hit API rate limits. Switching to a deliberate, one-tap scanning model made the app vastly calmer and more predictable to use.

## Accomplishments that we're proud of

We are most proud of building an interface that is genuinely usable eyes-free. It relies on massive touch targets and clear audio cues rather than complex visual menus. We're also incredibly proud of the styling engine, which elevates Lumina from a simple utility tool into a true fashion companion.

## What we learned

We learned that true accessibility is about deep application logic and user experience, not just adding high-contrast colors. We also learned that technical constraints—like API rate limits—often force you into making much better, simpler design choices for your end user.

## What's next for Lumina

- **Care tag symbol decoding:** Translating universal laundry symbols into plain spoken English.
- **Wardrobe memory:** Saving previously scanned items so the AI can suggest outfits using clothes the shopper actually owns.
- **Multilingual support:** Offering fashion descriptions in multiple languages using native device voices.
