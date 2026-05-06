class OrderStateMachine:
    def transition(self, order, new_state):
        valid = {
            "created": ["validated", "rejected"],
            "validated": ["filled"],
            "filled": ["closed"]
        }

        if new_state not in valid.get(order.status, []):
            raise Exception(f"Invalid transition {order.status} -> {new_state}")

        order.status = new_state
        return order
