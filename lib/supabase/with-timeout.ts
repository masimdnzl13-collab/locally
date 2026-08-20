// Supabase'e giden bir ağ çağrısı yavaş/erişilemez olduğunda isteği asla
// bloklamamak için kullanılır: süre dolduğunda hata fırlatmak yerine
// fallback değeriyle "başarısız ama sessiz" şekilde devam eder.
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);
  } catch {
    return fallback;
  }
}
