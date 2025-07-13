import BleReader from "@/components/BleReader";
import AuthWrapper from "@/components/admin/auth-wrapper";
import { isAuthenticated } from "@/app/actions/config";

export default async function Home() {
  const authenticated = await isAuthenticated();
  return (
    <AuthWrapper isAuthenticated={authenticated}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-purple-950 dark:text-gray-100">
        <h1 className="text-2xl font-bold dark:text-white">List of bluetooth devices</h1>
        <BleReader />
      </div>
    </AuthWrapper>
  );
}