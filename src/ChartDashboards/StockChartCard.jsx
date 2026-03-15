import './StockChartCard.css';
import StockCard from './StockCard';
import ScorePanel from './ScorePanel';
import useUser from '../hooks/useUser';

const StockChartCard = ({ annotations = { annotations }, cardData = { cardData }, priceData = { priceData }, stock, children }) => {
    
    const { user, loading } = useUser();

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
                isPaid={user?.has_unlimited_coins}
                trades={annotations}
                priceData={priceData}
            />

        </div>
    );
};

export default StockChartCard;