import './StockCard.css';

const StockCard = ({ stock }) => {
    const {
        symbol,
        exchange = "NSE",
        price,
        change,
        changePercent
    } = stock || {};

    const isUp = change > 0;
    console.log("Rendering StockCard for:", symbol);
    return (
        <div className="stockCard">
            <div className="stockLeft">
                <span className="stockSymbol">{symbol}</span>
                <span className="stockExchange">{exchange}</span>
            </div>

            {price != null && (
                <div className="stockRight">
                    <span className="stockPrice">₹{price}</span>
                    {change != null && (
                        <span
                            className={`stockChange ${isUp ? "up" : "down"}`}
                        >
                            {isUp ? "+" : ""}
                            {change} ({changePercent}%)
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default StockCard;
