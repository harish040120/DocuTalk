FROM python:3.12-slim

WORKDIR /app

# Install CPU-only torch first (the Space runs on cpu-basic) to keep the image lean
# and avoid pulling the multi-GB CUDA build.
COPY requirements.txt .
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu torch==2.13.0+cpu

# Install the remaining dependencies (torch is already satisfied, so it is skipped)
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["chainlit", "run", "app.py", "--host", "0.0.0.0", "--port", "8000"]
