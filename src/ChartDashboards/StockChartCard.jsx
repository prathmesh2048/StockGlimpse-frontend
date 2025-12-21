import './StockChartCard.css';
import StockCard from './StockCard';

const StockChartCard = ({ stock, children }) => {
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
        </div>
    );
};

export default StockChartCard;