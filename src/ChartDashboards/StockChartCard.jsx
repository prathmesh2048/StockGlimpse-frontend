import { useRef } from 'react';
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
    const scorePanelRef = useRef(null);

    const scrollToScore = () => {
        scorePanelRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    };

    return (
        <div className="stockChartCard">

            {/* Header overlay */}
            <div className="stockChartHeader">
                <StockCard stock={stock} onScoreClick={scrollToScore} />
            </div>

            {/* Chart area */}
            <div className="stockChartBody">
                {children}
            </div>

            {/* Score Panel */}
            {!loading && (
                <div ref={scorePanelRef}>
                    <ScorePanel
                        isPaid={user?.has_unlimited_coins || isDemo}
                        isDemo={isDemo}
                        trades={annotations}
                        priceData={priceData}
                    />
                </div>
            )}

        </div>
    );
};

export default StockChartCard;