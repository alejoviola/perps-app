import { useState, useEffect, useMemo, useCallback } from 'react';
import { isEstablished, useSession } from '@fogo/sessions-sdk-react';
import { UserIdentifierType } from '@fuul/sdk';
import type { ClaimResponse } from '@fuul/sdk';
import { IoGift } from 'react-icons/io5';
import { ConnectWalletCard } from '../components/ConnectWalletCard';
import { ViewLayout } from '../components/ViewLayout';
import { EmptyState } from '../components/EmptyState';
import { useFuul } from '~/contexts/FuulContext';
import { useUserDataStore } from '~/stores/UserDataStore';
import { useNotificationStore } from '~/stores/NotificationStore';
import { formatTokenAmount } from '../utils/format-numbers';
import { useClaimService } from '../hooks/useClaimService';
import styles from '../affiliates.module.css';

/**
 * TODO: Before production, remove console.log statements
 */
export function ClaimsView() {
    const sessionState = useSession();
    const isConnected = isEstablished(sessionState);
    const { userAddress } = useUserDataStore();
    const { getClaimableRewards } = useFuul();
    const {
        isLoading: isClaimLoading,
        error: claimError,
        executeClaim,
    } = useClaimService();
    const { add: addNotification } = useNotificationStore();

    const [claimableChecks, setClaimableChecks] = useState<ClaimResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchClaimableChecks = useCallback(async () => {
        if (!isConnected || !userAddress) return;

        setIsLoading(true);
        setError(null);

        try {
            console.log(
                '[ClaimsView] Fetching claimable checks for:',
                userAddress,
            );
            const result = await getClaimableRewards({
                user_identifier: userAddress,
                user_identifier_type: UserIdentifierType.SolanaAddress,
            });
            console.log('[ClaimsView] Claimable checks result:', result);
            setClaimableChecks(result || []);
        } catch (err) {
            console.error('[ClaimsView] Error fetching claimable checks:', err);
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to fetch claimable rewards',
            );
        } finally {
            setIsLoading(false);
        }
    }, [isConnected, userAddress, getClaimableRewards]);

    useEffect(() => {
        fetchClaimableChecks();
    }, [fetchClaimableChecks]);

    // Calculate total from valid claimable checks (already filtered by API)
    const totalClaimable = useMemo(() => {
        if (!claimableChecks || claimableChecks.length === 0) return 0;
        return claimableChecks.reduce((sum, check) => {
            return sum + parseFloat(check.amount);
        }, 0);
    }, [claimableChecks]);

    const hasClaimableRewards = totalClaimable > 0;

    const handleClaim = async () => {
        setError(null);
        console.log('[ClaimsView] Starting claim...');
        const result = await executeClaim();
        console.log('[ClaimsView] Claim result:', result);
        if (result.success) {
            // Show success notification
            addNotification({
                title: 'Rewards Claimed',
                message: `Successfully claimed $${formatTokenAmount(totalClaimable, 6)} in rewards`,
                icon: 'check',
            });
            // Clear claims to show empty state
            setClaimableChecks([]);
        } else if (result.error) {
            // Show error notification
            addNotification({
                title: 'Claim Failed',
                message: result.error,
                icon: 'error',
            });
            setError(result.error);
        }
    };

    const displayError = error || claimError;

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

    if (displayError && !hasClaimableRewards) {
        return (
            <ViewLayout title='Claims'>
                <div className={styles['glass-card']}>
                    <p style={{ color: 'var(--aff-negative)' }}>
                        {displayError}
                    </p>
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
                        disabled={!hasClaimableRewards || isClaimLoading}
                    >
                        {isClaimLoading ? 'Claiming...' : 'Claim Rewards'}
                    </button>
                </div>
            </div>
        </ViewLayout>
    );
}
