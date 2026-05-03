import './StockChartCard.css';
import StockCard from './StockCard';
import ScorePanel from './ScorePanel';
import useUser from '../hooks/useUser';

const StockChartCard = ({
    isDemo = false,
    annotations = [],
    cardData = {},
    priceData = [],
    stock,
    children
}) => {

    const { user, loading } = useUser();
    console.log("user in StockChartCard:", user);

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
            {!loading && (
                <ScorePanel
                    isPaid={user?.has_unlimited_coins || isDemo}
                    isDemo={isDemo}
                    trades={annotations}
                    priceData={priceData}
                />
            )}

        </div>
    );
};

export default StockChartCard;