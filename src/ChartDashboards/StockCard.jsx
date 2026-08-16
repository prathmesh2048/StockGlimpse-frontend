import './StockCard.css';

const StockCard = ({ stock, onScoreClick, score }) => {
    const {
        symbol,
        exchange = "NSE",
        price,
        change,
        changePercent
    } = stock || {};

    const isUp = change > 0;

    const scoreClass =
        score == null ? "" :
        score >= 70 ? "scoreGood" :
        score >= 50 ? "scoreMid" : "scoreLow";

    return (
        <div className="stockCard">
            <div className="stockLeft">
                <span className="stockSymbol">{symbol}</span>
                <span className="stockExchange">{exchange}</span>
            </div>

            <button
                type="button"
                className={`scoreButton ${scoreClass}`}
                onClick={onScoreClick}
            >
                {score != null ? `Score: ${score}` : "Scores"} <span className="scoreArrow">▼</span>
            </button>

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