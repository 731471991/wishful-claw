export interface GoalConfirmResponse {
  confirmed: boolean
}

export class GoalConfirmResolvers {
  private readonly resolvers = new Map<string, (payload: GoalConfirmResponse) => void>()

  register(goalId: string, resolve: (payload: GoalConfirmResponse) => void): void {
    const previous = this.resolvers.get(goalId)
    if (previous) previous({ confirmed: false })
    this.resolvers.set(goalId, resolve)
  }

  resolve(goalId: string, confirmed: boolean): boolean {
    const resolve = this.resolvers.get(goalId)
    if (!resolve) return false
    resolve({ confirmed })
    this.resolvers.delete(goalId)
    return true
  }

  has(goalId: string): boolean {
    return this.resolvers.has(goalId)
  }
}
