import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface UserData {
  id: string;
  email: string;
  free_songs_remaining: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function createUserProfile(authUser: any) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          id: authUser.id,
          email: authUser.email,
          free_songs_remaining: 1,
          is_premium: false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error creating profile:', error);
      throw new Error('Failed to create user profile');
    }
  }

  async function getUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      throw new Error('Failed to fetch user profile');
    }
  }

  async function checkUser() {
    try {
      setLoading(true);
      
      // Get authenticated user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) throw authError;

      if (!authUser) {
        navigate('/auth');
        return;
      }

      // Try to get existing profile
      let userProfile = await getUserProfile(authUser.id);

      // If no profile exists, create one
      if (!userProfile) {
        userProfile = await createUserProfile(authUser);
      }

      setUser(userProfile);
      
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load user data",
        variant: "destructive",
      });
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  }

  const handleCreateSong = () => {
    navigate('/');
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            Welcome Back!
          </h1>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>

        <div className="bg-card rounded-lg p-6 shadow-lg space-y-4">
          <h2 className="text-xl font-semibold">Your Account</h2>
          <div className="space-y-2">
            <p className="text-muted-foreground">Email: {user?.email}</p>
            <p className="text-muted-foreground">
              Free Songs Remaining: {user?.free_songs_remaining}
            </p>
          </div>
          <Button onClick={handleCreateSong}>Create New Song</Button>
        </div>
      </div>
    </div>
  );
}
