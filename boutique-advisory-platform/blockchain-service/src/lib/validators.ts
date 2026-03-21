import { z } from 'zod';

export const mintSchema = z.object({
  tenantId: z.string().min(1),
  dealId: z.string().min(1),
  syndicateId: z.string().min(1),
  tokenName: z.string().min(1),
  tokenSymbol: z.string().min(1),
  totalTokens: z.number().positive(),
  pricePerToken: z.number().positive(),
  ownerUserId: z.string().optional(),
  ownerAddress: z.string().optional(),
});

export const escrowCommitSchema = z.object({
  offeringId: z.string().min(1),
  investorId: z.string().min(1),
  amount: z.number().positive(),
});

export const escrowAllocateSchema = z.object({
  offeringId: z.string().min(1),
  allocations: z.array(
    z.object({
      investorId: z.string().min(1),
      tokens: z.number().positive(),
    })
  ).min(1),
});

export const escrowRefundSchema = z.object({
  offeringId: z.string().min(1),
  investors: z.array(z.string().min(1)).min(1),
});

export const balanceSchema = z.object({
  tokenAddress: z.string().min(1),
  walletAddress: z.string().min(1),
});
