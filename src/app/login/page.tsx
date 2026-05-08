import Image from 'next/image';
import { LoginForm } from '@/components/login-form';
import { getLogoUrl } from '@/services/logo-service';

export default async function LoginPage() {
    const logoUrl = await getLogoUrl();

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="w-full max-w-sm p-4 space-y-6">
                <Image 
                    src={logoUrl} 
                    alt="El Rio logo" 
                    width={150} 
                    height={150} 
                    className="mx-auto rounded-lg"
                    priority
                />
                <LoginForm />
            </div>
        </div>
    );
}
