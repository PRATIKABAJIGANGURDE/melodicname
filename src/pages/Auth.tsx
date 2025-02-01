import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

export default function Auth() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session);
      if (event === 'SIGNED_IN') {
        navigate("/dashboard");
      }
    });

    checkUser();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  async function checkUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      if (user) {
        console.log('User already logged in:', user);
        navigate("/dashboard");
      }
    } catch (error) {
      console.error('Error checking user:', error);
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      console.log('Starting Google login...');
      console.log('Current URL:', window.location.origin);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google login error:', error);
        toast({
          title: "Login Error",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }

      console.log('Google login response:', data);
      
    } catch (error: any) {
      console.error("Error logging in with Google:", error);
      toast({
        title: "Login Failed",
        description: error.message || "Failed to login with Google",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-background to-background -z-10" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-3xl -z-10" />
      
      <div className="max-w-md mx-auto space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            Welcome to MelodicName
          </h2>
          <p className="mt-2 text-muted-foreground">
            Sign in to create your personalized songs
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <Button
            className="w-full flex items-center justify-center space-x-2"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>{loading ? "Loading..." : "Continue with Google"}</span>
          </Button>

          {/* Debug info in development */}
          {import.meta.env.DEV && (
            <div className="mt-4 text-xs text-muted-foreground">
              <p>Redirect URL: {window.location.origin}/auth</p>
              <p>Make sure this URL is added to your Google OAuth and Supabase settings</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
