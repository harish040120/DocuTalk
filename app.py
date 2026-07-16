# Import necessary libraries
import PyPDF2
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_classic.chains import ConversationalRetrievalChain
from langchain_classic.memory import ChatMessageHistory, ConversationBufferMemory
import chainlit as cl
from dotenv import load_dotenv
import os

from langchain_community.embeddings import HuggingFaceEmbeddings

# Loading environment variables from .env file
load_dotenv()

# --- Choose the LLM backend ---
# If OPENROUTER_API_KEY is provided we use OpenRouter (handy for local dev).
# Otherwise we fall back to the free Hugging Face serverless Inference API so the
# app can run on HF Spaces with NO per-user API key (the Space's own HF_TOKEN is
# injected automatically by Hugging Face and used here).
openrouter_api_key = os.environ.get("OPENROUTER_API_KEY")
hf_token = os.environ.get("HF_TOKEN")

if openrouter_api_key:
    from langchain_openai import ChatOpenAI
    llm = ChatOpenAI(
        model=os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
        temperature=0.2,
        api_key=openrouter_api_key,
        base_url="https://openrouter.ai/api/v1",
        default_headers={
            "HTTP-Referer": "https://github.com/harish040120/DocuTalk",
            "X-Title": "DocuTalk",
        },
    )
else:
    from langchain_huggingface import HuggingFaceEndpoint, ChatHuggingFace
    hf_model = os.environ.get("HF_MODEL", "HuggingFaceH4/zephyr-7b-beta")
    llm_endpoint = HuggingFaceEndpoint(
        repo_id=hf_model,
        task="text-generation",
        max_new_tokens=512,
        temperature=0.2,
        huggingfacehub_api_token=hf_token or None,
    )
    llm = ChatHuggingFace(llm=llm_endpoint)


# Function to execute when the chat starts
@cl.on_chat_start
async def on_chat_start():
    # Display initial message and ask user to upload PDF files
    elements = [
    cl.Image(name="image1", display="inline", path="screen-0.jpg")
    ]
    await cl.Message(content="DocuTalk here, How can I help you?", elements=elements).send()
    files = None #Initialize variable to store uploaded files

    # Wait for the user to upload files
    while files is None:
        files = await cl.AskFileMessage(
            content="Please upload one or more pdf files to begin!",
            accept=["application/pdf"],
            max_size_mb=100,# Optionally limit the file size,
            max_files=10,
            timeout=180, # Set a timeout for user response,
        ).send()

    # Process each uploaded file
    texts = []
    metadatas = []
    for file in files:
        print(file) # Print the file object for debugging

        # Read the PDF file
        pdf = PyPDF2.PdfReader(file.path)
        pdf_text = ""
        for page in pdf.pages:
            pdf_text += page.extract_text()
            
        # Split the text into chunks
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=50)
        file_texts = text_splitter.split_text(pdf_text)
        texts.extend(file_texts)

        # Create a metadata for each chunk
        file_metadatas = [{"source": f"{i}-{file.name}"} for i in range(len(file_texts))]
        metadatas.extend(file_metadatas)

    # Create a Chroma vector store
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    docsearch = await cl.make_async(Chroma.from_texts)(
        texts, embeddings, metadatas=metadatas
    )
    
    # Initialize message history for conversation
    message_history = ChatMessageHistory()
    
    # Memory for conversational context
    memory = ConversationBufferMemory(
        memory_key="chat_history",
        output_key="answer",
        chat_memory=message_history,
        return_messages=True,
    )

    # Create a chain that uses the Chroma vector store
    chain = ConversationalRetrievalChain.from_llm(
        llm=llm,
        chain_type="stuff",
        retriever=docsearch.as_retriever(),
        memory=memory,
        return_source_documents=True,
    )
    
    
    # Inform the user that processing has ended.You can now chat.
    msg = cl.Message(content=f"{len(files)} Files Processed.Shoot me up with your queries!")
    await msg.send()

    #store the chain in user session
    cl.user_session.set("chain", chain)


# Function to execute when a message is received
@cl.on_message
async def main(message: cl.Message):
     # Retrieve the chain from user session
    chain = cl.user_session.get("chain") 
    #call backs happens asynchronously/parallel 
    cb = cl.AsyncLangchainCallbackHandler()
    
    # call the chain with user's message content
    res = await chain.ainvoke(message.content, callbacks=[cb])
    answer = res["answer"]
    source_documents = res["source_documents"] 

    text_elements = [] # Initialize list to store text elements
    
    # Process source documents if available
    if source_documents:
        for source_idx, source_doc in enumerate(source_documents):
            source_name = f"source_{source_idx}"
            # Create the text element referenced in the message
            text_elements.append(
                cl.Text(content=source_doc.page_content, name=source_name)
            )
        source_names = [text_el.name for text_el in text_elements]
        
         # Add source references to the answer
        if source_names:
            answer += f"\nSources: {', '.join(source_names)}"
        else:
            answer += "\nNo sources found"
    #return results
    await cl.Message(content=answer, elements=text_elements).send()
