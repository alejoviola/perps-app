import { useState, useEffect, useMemo } from 'react';
import { isEstablished, useSession } from '@fogo/sessions-sdk-react';
import { UserIdentifierType } from '@fuul/sdk';
import type { GetClaimCheckTotalsResponse } from '@fuul/sdk';
import { IoGift } from 'react-icons/io5';
import { ConnectWalletCard } from '../components/ConnectWalletCard';
import { ViewLayout } from '../components/ViewLayout';
import { EmptyState } from '../components/EmptyState';
import { useFuul } from '~/contexts/FuulContext';
import { useUserDataStore } from '~/stores/UserDataStore';
import { formatTokenAmount } from '../utils/format-numbers';
import styles from '../affiliates.module.css';

export function ClaimsView() {
    const sessionState = useSession();
    const isConnected = isEstablished(sessionState);
    const { userAddress } = useUserDataStore();
    const { getClaimTotals } = useFuul();

    const [claimTotals, setClaimTotals] =
        useState<GetClaimCheckTotalsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchClaimTotals() {
            if (!isConnected || !userAddress) return;

            setIsLoading(true);
            setError(null);

            try {
                const result = await getClaimTotals({
                    user_identifier: userAddress,
                    user_identifier_type: UserIdentifierType.SolanaAddress,
                });
                setClaimTotals(result);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Failed to fetch claim totals',
                );
            } finally {
                setIsLoading(false);
            }
        }

        fetchClaimTotals();
    }, [isConnected, userAddress, getClaimTotals]);

    const totalClaimable = useMemo(() => {
        if (!claimTotals?.unclaimed) return 0;
        return claimTotals.unclaimed.reduce((sum, item) => {
            return sum + parseFloat(item.amount);
        }, 0);
    }, [claimTotals]);

    const hasClaimableRewards = totalClaimable > 0;

    const handleClaim = () => {
        // Claim logic will be implemented later
        console.log('Claim rewards clicked');
    };

    if (!isConnected) {
        return (
            <ViewLayout title='Claims'>
                <ConnectWalletCard
                    title='Connect to view claimable rewards'
                    description='Sign in to see your available rewards and claim them'
                />
            </ViewLayout>
        );
    }

    if (isLoading) {
        return (
            <ViewLayout title='Claims'>
                <div className={styles['page-loader']}>
                    <div className={styles.loader} />
                </div>
            </ViewLayout>
        );
    }

    if (error) {
        return (
            <ViewLayout title='Claims'>
                <div className={styles['glass-card']}>
                    <p style={{ color: 'var(--aff-negative)' }}>{error}</p>
                </div>
            </ViewLayout>
        );
    }

    if (!hasClaimableRewards) {
        return (
            <ViewLayout title='Claims'>
                <div className={styles['table-container']}>
                    <EmptyState
                        icon={IoGift}
                        title='No rewards to claim'
                        description='Your claimable rewards will appear here once you earn commissions'
                    />
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            padding: '0 1.5rem 1.5rem',
                        }}
                    >
                        <button
                            className={`${styles.btn} ${styles['btn-primary']} ${styles['btn-lg']}`}
                            disabled
                        >
                            Claim Rewards
                        </button>
                    </div>
                </div>
            </ViewLayout>
        );
    }

    return (
        <ViewLayout title='Claims'>
            <div className={styles['glass-card']}>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1.5rem',
                        padding: '2rem',
                    }}
                >
                    <span
                        style={{
                            fontSize: '1.5rem',
                            fontWeight: 600,
                            color: 'var(--aff-text-primary)',
                        }}
                    >
                        Claim ${formatTokenAmount(totalClaimable, 6)} in rewards
                    </span>
                    <button
                        className={`${styles.btn} ${styles['btn-primary']} ${styles['btn-lg']}`}
                        onClick={handleClaim}
                        disabled={!hasClaimableRewards}
                    >
                        Claim Rewards
                    </button>
                </div>
            </div>
        </ViewLayout>
    );
}
