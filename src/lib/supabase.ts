export const supabase = {
  auth: {
    onAuthStateChange: (_event: unknown, _cb: unknown) => ({
      data: { subscription: { unsubscribe: () => {} } }
    }),
    signOut: async () => {}
  }
};
