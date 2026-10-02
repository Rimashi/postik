.PHONY: setup run check health

setup:
	python3 -m venv .venv
	.venv/bin/python -m pip install --upgrade pip
	.venv/bin/pip install -r requirements.txt

run:
	.venv/bin/python app.py

check:
	.venv/bin/python -m compileall -q app app.py

health:
	curl -fsS http://127.0.0.1:8000/api/health
