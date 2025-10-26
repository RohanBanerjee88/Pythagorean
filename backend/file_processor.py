import pypdf
from docx import Document as DocxDocument
import pandas as pd
import os
from typing import Tuple


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF file"""
    text = ""
    with open(file_path, 'rb') as file:
        pdf_reader = pypdf.PdfReader(file)
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
    return text


def extract_text_from_docx(file_path: str) -> str:
    """Extract text from Word document"""
    doc = DocxDocument(file_path)
    text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
    return text


def extract_text_from_excel(file_path: str) -> str:
    """Extract text from Excel file - converts to readable format"""
    df = pd.read_excel(file_path)
    # Convert dataframe to string representation
    text = df.to_string()
    return text


def extract_text_from_txt(file_path: str) -> str:
    """Extract text from text file"""
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
        text = file.read()
    return text


def extract_text(file_path: str) -> Tuple[str, str]:
    """
    Main function to extract text from any supported file type
    Returns: (extracted_text, file_type)
    """
    file_ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if file_ext == '.pdf':
            return extract_text_from_pdf(file_path), 'pdf'
        elif file_ext in ['.docx', '.doc']:
            return extract_text_from_docx(file_path), 'docx'
        elif file_ext in ['.xlsx', '.xls']:
            return extract_text_from_excel(file_path), 'excel'
        elif file_ext in ['.txt', '.md']:
            return extract_text_from_txt(file_path), 'text'
        else:
            raise ValueError(f"Unsupported file type: {file_ext}")
    except Exception as e:
        raise Exception(f"Error extracting text from {file_ext}: {str(e)}")