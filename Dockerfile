# Usar imagen base de Python
FROM python:3.11-slim

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de requisitos
COPY requirements.txt .
COPY bots/telegram/requirements.txt ./bots_requirements.txt

# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código del proyecto
COPY . .

# Establecer directorio de trabajo para el bot
WORKDIR /app/bots/telegram

# Comando para ejecutar el bot
CMD ["python", "bot_improved.py"]
