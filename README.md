# DocuTalk: Your Personal Document-Based Conversational AI

![DocuTalk Banner](screen-0.jpg)

DocuTalk is an intelligent conversational assistant that leverages the power of Large Language Models to chat with your PDF documents. Simply upload one or more PDFs, and DocuTalk will answer your questions based on their content. It's built with Python, Chainlit, LangChain, and uses Groq for high-speed inference and Ollama for state-of-the-art text embeddings.

## Features

-   **Interactive Chat Interface**: A user-friendly interface built with [Chainlit](https://chainlit.io) that allows for seamless uploading of documents and conversation.
-   **Multi-PDF Support**: Upload up to 10 PDF files at once for a comprehensive Q&A session.
-   **High-Speed Responses**: Powered by the [Groq](https://groq.com/) LPU™ Inference Engine and the Llama3-70b-8192 model.
-   **Advanced Text Analysis**: Utilizes `nomic-embed-text` via [Ollama](https://ollama.com/) for efficient and accurate text embeddings.
-   **Conversational Memory**: Remembers the context of the conversation to provide relevant, follow-up answers.
-   **Source Citing**: Cites the sources from the documents that were used to generate the answer.

## Prerequisites

This application uses [Ollama](https://ollama.com/) to generate text embeddings locally. Before you begin, you need to have Ollama installed and running.

1.  **Install Ollama**: Follow the instructions on the [Ollama website](https://ollama.com/download).
2.  **Pull the Embedding Model**: Once Ollama is running, pull the `nomic-embed-text` model by running the following command in your terminal:
    ```bash
    ollama pull nomic-embed-text
    ```

## Installation & Setup

1.  **Clone the Repository**:
    ```bash
    git clone <your-repository-url>
    cd <repository-directory>
    ```

2.  **Install Dependencies**:
    Create a virtual environment (recommended) and install the required Python packages.
    ```bash
    pip install -r requirements.txt
    ```

3.  **Set Up Environment Variables**:
    Create a file named `.env` in the root of your project directory and add your Groq API key:
    ```dotenv
    GROQ_API_KEY="your-groq-api-key"
    ```
    You can get a free API key from the [Groq Console](https://console.groq.com/keys).

## Usage

1.  **Ensure Ollama is Running**: Make sure the Ollama application is running in the background.
2.  **Run the Application**:
    Execute the following command in your terminal:
    ```bash
    chainlit run app.py
    ```
3.  **Interact with DocuTalk**:
    -   The application will open in a new browser tab.
    -   Follow the on-screen instructions to upload your PDF files.
    -   Once the files are processed, you can start asking questions!
