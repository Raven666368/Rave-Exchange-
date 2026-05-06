from fastapi import FastAPI
from app.engine.execution_engine import ExecutionEngine
from app.models.order import Order

app = FastAPI()
engine = ExecutionEngine()

@app.get("/")
def health():
    return {"status": "Rave Engine Running"}

@app.post("/order")
def place_order(order: Order):
    price = 1.1000  # mock market price
    result = engine.place_order(order, price)
    return result
