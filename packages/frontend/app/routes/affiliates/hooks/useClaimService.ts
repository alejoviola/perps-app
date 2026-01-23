import { useCallback, useState } from 'react';
import {
    isEstablished,
    useConnection,
    useSession,
} from '@fogo/sessions-sdk-react';
import { PublicKey } from '@solana/web3.js';
import {
    FuulSdk,
    Network,
    ClaimMessage,
    ClaimMessageData,
    MessageDomain,
    TokenType,
    ClaimReason,
    FUUL_PROGRAM_ID,
} from '@fuul/sdk-solana';
import { UserIdentifierType } from '@fuul/sdk';
import type { ClaimResponse } from '@fuul/sdk';
import { useFuul } from '~/contexts/FuulContext';
import { useUserDataStore } from '~/stores/UserDataStore';

/**
 * Creates an anchor.BN-compatible object using native BigInt.
 * Avoids importing bn.js which is not a direct dependency.
 */
function createBNLike(value: string | number | bigint) {
    const bigIntValue = BigInt(value);
    return {
        toString: (base?: number) => {
            if (base === 16) return bigIntValue.toString(16);
            return bigIntValue.toString();
        },
        toNumber: () => Number(bigIntValue),
        toArray: (endian?: string, length?: number) => {
            const len = length || 8;
            const buf = Buffer.alloc(len);
            if (endian === 'be') {
                buf.writeBigUInt64BE(bigIntValue);
            } else {
                buf.writeBigUInt64LE(bigIntValue);
            }
            return Array.from(buf);
        },
        toArrayLike: (
            _ArrayType: unknown,
            endian?: string,
            length?: number,
        ) => {
            const len = length || 8;
            const buf = Buffer.alloc(len);
            if (endian === 'be') {
                buf.writeBigUInt64BE(bigIntValue);
            } else {
                buf.writeBigUInt64LE(bigIntValue);
            }
            return buf;
        },
        toBuffer: (endian?: string, length?: number) => {
            const len = length || 8;
            const buf = Buffer.alloc(len);
            if (endian === 'be') {
                buf.writeBigUInt64BE(bigIntValue);
            } else {
                buf.writeBigUInt64LE(bigIntValue);
            }
            return buf;
        },
    };
}

export interface ClaimServiceResult {
    success: boolean;
    error?: string;
    signature?: string;
}

export interface UseClaimServiceReturn {
    isLoading: boolean;
    error: string | null;
    executeClaim: () => Promise<ClaimServiceResult>;
}

/**
 * Hook for managing claim functionality with Solana transactions
 *
 * TODO: Before production, remove the following testing code:
 * - Remove all console.log statements
 * - Set DRY_RUN = false or remove the DRY_RUN block entirely
 * - Use check.nonce from API instead of mocked nonce (0)
 * - Re-enable Ed25519 instruction in buildClaimInstructions
 */
export function useClaimService(): UseClaimServiceReturn {
    const sessionState = useSession();
    const connection = useConnection();
    const { userAddress } = useUserDataStore();
    const { getClaimableRewards } = useFuul();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const executeClaim = useCallback(async (): Promise<ClaimServiceResult> => {
        console.log('[useClaimService] executeClaim called', {
            isEstablished: isEstablished(sessionState),
            userAddress,
        });

        if (!isEstablished(sessionState) || !userAddress) {
            console.log('[useClaimService] Session not established');
            return {
                success: false,
                error: 'Session not established',
            };
        }

        setIsLoading(true);
        setError(null);

        try {
            // Fetch claimable rewards from API
            console.log('[useClaimService] Fetching claimable rewards...');
            const claimableChecks = await getClaimableRewards({
                user_identifier: userAddress,
                user_identifier_type: UserIdentifierType.SolanaAddress,
            });
            console.log('[useClaimService] Claimable checks:', claimableChecks);

            if (!claimableChecks || claimableChecks.length === 0) {
                console.log('[useClaimService] No rewards to claim');
                return {
                    success: false,
                    error: 'No rewards to claim',
                };
            }

            // Initialize FuulSdk
            console.log('[useClaimService] Initializing FuulSdk...');
            const network = Network.FOGO_MAINNET;
            const programId = FUUL_PROGRAM_ID[network];
            const fuulSdk = new FuulSdk(connection, network, programId);

            const userWalletKey =
                sessionState.walletPublicKey || sessionState.sessionPublicKey;
            console.log(
                '[useClaimService] User wallet key:',
                userWalletKey?.toString(),
            );

            // Build claim instructions for all claimable checks
            const allInstructions: ReturnType<
                typeof buildClaimInstructions
            > extends Promise<infer T>
                ? T
                : never = [];

            console.log(
                '[useClaimService] Building instructions for',
                claimableChecks.length,
                'checks',
            );
            for (const check of claimableChecks) {
                console.log('[useClaimService] Processing check:', check);
                console.log(
                    '[useClaimService] Signatures count:',
                    check.signatures?.length,
                );
                const instructions = await buildClaimInstructions(
                    fuulSdk,
                    check,
                    userWalletKey,
                    programId,
                );
                console.log(
                    '[useClaimService] Built',
                    instructions.length,
                    'instructions',
                );
                allInstructions.push(...instructions);
            }

            // Ensure sendTransaction is available
            if (typeof sessionState.sendTransaction !== 'function') {
                throw new Error('sendTransaction is not available');
            }

            // TODO: Remove DRY_RUN mode for production
            const DRY_RUN = true;
            if (DRY_RUN) {
                console.log(
                    '[useClaimService] DRY RUN MODE - Simulating success',
                );
                console.log(
                    '[useClaimService] Would send',
                    allInstructions.length,
                    'instructions',
                );
                // Simulate a delay like a real transaction
                await new Promise((resolve) => setTimeout(resolve, 1500));
                return {
                    success: true,
                    signature: 'DRY_RUN_MOCK_SIGNATURE_' + Date.now(),
                };
            }

            // Send transaction with instructions array (matching depositService pattern)
            console.log(
                '[useClaimService] Sending transaction with',
                allInstructions.length,
                'instructions',
            );
            const transactionResult =
                await sessionState.sendTransaction(allInstructions);
            console.log(
                '[useClaimService] Transaction result:',
                transactionResult,
            );

            // Check for success - transaction result should have signature and no error
            const result = transactionResult as {
                signature?: string;
                error?: string;
                confirmed?: boolean;
            };

            if (result && result.signature && !result.error) {
                return {
                    success: true,
                    signature: result.signature,
                };
            } else {
                const errorMessage =
                    typeof result?.error === 'string'
                        ? result.error
                        : 'Claim transaction failed';
                throw new Error(errorMessage);
            }
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : 'Claim failed';
            setError(errorMessage);
            console.error('[useClaimService] Claim error:', err);
            return {
                success: false,
                error: errorMessage,
            };
        } finally {
            console.log('[useClaimService] Setting isLoading to false');
            setIsLoading(false);
        }
    }, [sessionState, connection, userAddress, getClaimableRewards]);

    return {
        isLoading,
        error,
        executeClaim,
    };
}

/**
 * Build claim instructions from a ClaimResponse
 */
async function buildClaimInstructions(
    fuulSdk: FuulSdk,
    check: ClaimResponse,
    userWallet: PublicKey,
    programId: PublicKey,
) {
    // TODO: Use check.nonce when API includes it
    // Mock nonce for testing
    const projectNonce = createBNLike(0);

    // Convert currency_type to TokenType
    const tokenType =
        check.currency_type === 1 ? TokenType.FungibleSpl : TokenType.Native;

    // Convert reason to ClaimReason
    const claimReason =
        check.reason === 0
            ? ClaimReason.AffiliatePayout
            : ClaimReason.EndUserPayout;

    // Parse the proof from hex string to Buffer
    const proofBuffer = Buffer.from(check.proof.replace('0x', ''), 'hex');

    // Create the ClaimMessageData
    const claimMessageData = new ClaimMessageData({
        amount: BigInt(check.amount),
        project: new PublicKey(check.project_address),
        recipient: userWallet,
        tokenType,
        tokenMint: new PublicKey(check.currency),
        proof: proofBuffer,
        reason: claimReason,
    });

    // Create MessageDomain
    const messageDomain = new MessageDomain({
        programId,
        version: 1,
        deadline: BigInt(check.deadline),
    });

    // Create ClaimMessage
    const claimMessage = new ClaimMessage({
        data: claimMessageData,
        domain: messageDomain,
    });

    // Parse signatures from API response
    const signatures = check.signatures.map((sig) => {
        const sigBytes = Buffer.from(sig.replace('0x', ''), 'hex');
        // The first 32 bytes are the public key, the rest is the signature
        const signerBytes = sigBytes.slice(0, 32);
        const signatureBytes = sigBytes.slice(32);
        return {
            signature: new Uint8Array(signatureBytes),
            signer: new PublicKey(signerBytes),
        };
    });

    // Build claim instruction using the SDK
    const instructions = await fuulSdk.claim({
        authority: userWallet,
        projectNonce,
        message: claimMessage,
        signatures,
    });

    // TODO: Re-enable Ed25519 instruction for production
    // The Ed25519 instruction is large and causes transaction size issues
    // For testing, we skip it but it's required for on-chain signature verification
    // const ed25519Instruction =
    //     claimMessage.createEd25519InstructionWithMultipleSigners(signatures);

    // return [ed25519Instruction, ...instructions];
    return [...instructions];
}
