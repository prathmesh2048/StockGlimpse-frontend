import './StockChartCard.css';
import StockCard from './StockCard';
import ScorePanel from './ScorePanel';

const StockChartCard = ({ annotations = { annotations }, cardData = { cardData }, priceData = { priceData }, stock, children }) => {
    return (
        <div className="stockChartCard">

            {/* Header overlay */}
            <div className="stockChartHeader">
                <StockCard stock={stock} />
            </div>

            {/* Chart area */}
            <div className="stockChartBody">
                {children}
            </div>

            {/* Score Panel */}
            <ScorePanel
                isPaid={true}
                trades={annotations}
                priceData={priceData}
            />

        </div>
    );
};

export default StockChartCard;