---
title: DocuTalk
emoji: 📄
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 8000
short_description: "Chat with your PDFs using open LLMs — no API key required."
python_version: "3.12"
startup_duration_timeout: 30m
---

# DocuTalk: Your Personal Document-Based Conversational AI

![DocuTalk Banner](screen-0.jpg)

DocuTalk is an intelligent conversational assistant that lets you chat with your PDF
documents. Upload one or more PDFs and DocuTalk answers questions based on their
content, citing the sources it used. It is built with [Chainlit](https://chainlit.io),
[LangChain](https://python.langchain.com/), and runs entirely on open models from the
Hugging Face Hub — **no API key or paid subscription required from the visitor**.

## How it works (zero per-user key)

- **LLM**: Uses the free Hugging Face serverless Inference API
  (`langchain_huggingface.ChatHuggingFace`) pointed at an open chat model
  (default `HuggingFaceH4/zephyr-7b-beta`). The Space's own `HF_TOKEN` is used, so
  visitors don't need to provide anything.
- **Embeddings**: `HuggingFaceEmbeddings` (`sentence-transformers/all-MiniLM-L6-v2`)
  run locally inside the Space on CPU — no external embedding service needed.
- **Vector store**: Chroma, kept in memory for the session.
- **UI**: Chainlit — upload PDFs, ask questions, see cited sources.

## Features

- **Interactive Chat Interface** built with Chainlit for seamless document upload and conversation.
- **Multi-PDF Support**: Upload up to 10 PDF files at once.
- **Open & Free Inference**: Powered by open models on the Hugging Face Hub.
- **Conversational Memory**: Remembers context for relevant follow-up answers.
- **Source Citing**: Shows the document chunks used to generate each answer.

## Running locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Optional: use OpenRouter instead of HF by setting OPENROUTER_API_KEY in .env
chainlit run app.py
```

Environment variables (all optional):

| Variable             | Default                          | Purpose                                            |
| -------------------- | -------------------------------- | -------------------------------------------------- |
| `HF_TOKEN`           | (auto-injected on HF Spaces)     | Token used to call the HF Inference API            |
| `HF_MODEL`           | `HuggingFaceH4/zephyr-7b-beta`   | Any text-generation model on the HF Hub            |
| `OPENROUTER_API_KEY` | unset                            | If set, OpenRouter is used instead of the HF API   |

## Usage

1. Open the Space (or run locally) and upload one or more PDF files.
2. Wait for the "Files Processed" message.
3. Ask questions about the documents and review the cited sources.
