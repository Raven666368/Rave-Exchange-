class SignalArbitrator:

    def resolve(self, signals):

        buy_score = 0
        sell_score = 0

        for s in signals:
            if s["decision"] == "buy":
                buy_score += s["strength"]
            else:
                sell_score += s["strength"]

        if buy_score > sell_score and buy_score > 1.0:
            return "buy"

        if sell_score > buy_score and sell_score > 1.0:
            return "sell"

        return None
