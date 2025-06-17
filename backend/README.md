# FastAPI Backend

Install dependencies:
```bash
pip install -r requirements.txt
```

Service credentials are stored with hashed passwords. Set a strong `SECRET_KEY`
environment variable before starting the server.

Run the development server:
```bash
SECRET_KEY=your-secret uvicorn main:app --reload
```
