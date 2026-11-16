# CodePresent

CodePresent turns code into slide presentations in your browser. Explaining a project usually means copying code into slides by hand and fighting with formatting. Here you make slides with real syntax-highlighted code, or let AI read a GitHub repo or a ZIP file and draft the whole presentation for you, then export it as a narrated video.

Everything is saved in your own browser. Your presentations and your API keys never go to a server of ours.

## Features

1. **Slides with real code:** titles, text, images and syntax-highlighted code blocks.
2. **Generate from a repo:** paste a GitHub repository link or upload a ZIP, and AI writes a presentation about the code.
3. **Present it:** a full-screen play mode for showing your slides.
4. **Export as a video:** turn the slides into an MP4 video at 1080p or 720p, with optional spoken narration (Gemini text to speech) and your own delay between slides. The video is made in your browser.
5. **Use any AI you like:** set the address, key and model for an OpenAI-compatible text model, Gemini for the voice, and any image models.
6. **Keep and share your work:** rename, delete, search and export presentations as JSON, and import them again.
7. **Light and dark mode.**

## Run it

You need [Node.js](https://nodejs.org/).

```bash
git clone https://github.com/p32929/code_present_reactts.git
cd code_present_reactts
yarn          # or npm install
yarn dev      # or npm run dev
```

Then open the address it prints. To make a production build, run `yarn build`.

## Set up the AI features

Open **AI Settings** in the generate dialog and fill in:

1. **Text model:** an OpenAI-compatible base URL, API key and model name. This writes the slides.
2. **Voice (optional):** one or more Gemini API keys for the spoken narration.
3. **Images (optional):** an OpenAI-compatible base URL, key and one or more image model names.

You can make and present slides without any of these. They are only needed for the AI features.

## Good to know

1. Data lives in your browser's storage. Clearing the site data deletes your presentations, so export the ones you want to keep.
2. Very large repos are trimmed: only code files are read, up to 100 KB per file and 500 KB in total.

Built with React, TypeScript, Vite, Tailwind and ffmpeg.wasm.

## Contributing

Contributions are very welcome. Please open an issue first to talk about what you'd like to add or change, so we can agree on it before you spend time on a pull request. Thank you!

## Share

<a href="https://p32929.github.io/share/?repo=code_present_reactts"><img src="https://p32929.github.io/readme/share.svg" alt="Share this with your friends in just a click" width="420"></a>

## Support

<a href="https://p32929.github.io/support/"><img src="https://p32929.github.io/readme/support.svg" alt="If you like my works and want to support me, feel free to support" width="420"></a>
