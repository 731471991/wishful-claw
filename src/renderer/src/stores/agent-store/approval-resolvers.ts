const approvalResolvers = new Map<string, (approved: boolean) => void>()
const approvalMetadata = new Map<
  string,
  { requestId: string; replyTo?: string; source: 'teammate' | 'teammate-plan' }
>()

export { approvalResolvers, approvalMetadata }
