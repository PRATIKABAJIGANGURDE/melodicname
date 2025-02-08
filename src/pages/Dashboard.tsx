import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PremiumPlanModal from "@/components/PremiumPlanModal";

interface UserData {
  id: string;
  email: string;
  free_songs_remaining: number;
  is_premium: boolean;
  created_at: string;
}

interface SongData {
  id: string;
  created_at: string;
  user_id: string;
  artist_name: string;
  recipient: string;
  genre: string;
  song_name: string;
  whatsapp: string;
  email: string;
  photo_url: string | null;
  additional_notes: string;
  status: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<UserData | null>(null);
  const [songs, setSongs] = useState<SongData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSongs: 0,
    completedSongs: 0,
    pendingSongs: 0,
    favoriteGenre: '',
  });
  const [showPremiumPlanModal, setShowPremiumPlanModal] = useState(false);

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

  async function fetchUserSongs(userId: string) {
    try {
      const { data, error } = await supabase
        .from('song_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSongs(data || []);

      // Calculate stats
      const totalSongs = data?.length || 0;
      const completedSongs = data?.filter(song => song.status === 'completed').length || 0;
      const pendingSongs = data?.filter(song => song.status === 'pending').length || 0;
      
      // Calculate favorite genre
      const genreCounts = data?.reduce((acc: {[key: string]: number}, song) => {
        acc[song.genre] = (acc[song.genre] || 0) + 1;
        return acc;
      }, {});
      const favoriteGenre = Object.entries(genreCounts || {})
        .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'None';

      setStats({
        totalSongs,
        completedSongs,
        pendingSongs,
        favoriteGenre,
      });

    } catch (error) {
      console.error('Error fetching songs:', error);
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
    console.log('Create Song clicked');
    console.log('User:', user);
    console.log('Free songs remaining:', user?.free_songs_remaining);
    if (user && user.free_songs_remaining > 0) {
      console.log('Navigating to /song-creation-form');
      navigate('/song-creation-form');
    } else {
      console.log('Showing premium plan modal');
      setShowPremiumPlanModal(true);
    }
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

  const handleSongReceived = async (songId: string) => {
    try {
      const { error } = await supabase
        .from('song_requests')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', songId);

      if (error) {
        console.error('Error updating song status:', error);
        throw error;
      }

      toast({
        title: "Status Updated",
        description: "Song has been marked as received!",
      });

      // Refresh the songs list
      if (user?.id) {
        fetchUserSongs(user.id);
      }
    } catch (error) {
      console.error('Error updating song status:', error);
      toast({
        title: "Error",
        description: "Failed to update song status",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchUserSongs(user.id);

      // Subscribe to changes in the songs table
      const songsSubscription = supabase
        .channel('songs_channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'song_requests',
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            // Refresh both songs and user profile
            fetchUserSongs(user.id);
            const updatedProfile = await getUserProfile(user.id);
            if (updatedProfile) {
              setUser(updatedProfile);
            }
          }
        )
        .subscribe();

      // Cleanup subscription on unmount
      return () => {
        songsSubscription.unsubscribe();
      };
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
              Welcome Back!
            </h1>
            <p className="text-muted-foreground mt-1">Manage your songs and account here</p>
          </div>
          <div className="space-x-4">
            <Button onClick={handleCreateSong}>Create New Song</Button>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{stats.totalSongs}</CardTitle>
              <CardDescription>Total Songs</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{stats.completedSongs}</CardTitle>
              <CardDescription>Completed Songs</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{stats.pendingSongs}</CardTitle>
              <CardDescription>Pending Songs</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{stats.favoriteGenre}</CardTitle>
              <CardDescription>Favorite Genre</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Account Type</p>
                <p className="font-medium">{user?.is_premium ? 'Premium' : 'Free'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Free Songs Remaining</p>
                <p className="font-medium">{user?.free_songs_remaining}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Member Since</p>
                <p className="font-medium">{new Date(user?.created_at || '').toLocaleDateString()}</p>
              </div>
            </div>
            {!user?.is_premium && (
              <button 
                onClick={() => setShowPremiumPlanModal(true)} 
                className="bg-primary hover:bg-primary/90 transition-all duration-200 text-white py-2 px-4 rounded"
              >
                Upgrade to Premium
              </button>
            )}
          </CardContent>
        </Card>

        {/* Recent Songs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Songs</CardTitle>
            <CardDescription>Your recently created songs and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Song Name</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Genre</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {songs.map((song) => (
                  <TableRow key={song.id}>
                    <TableCell>{song.song_name}</TableCell>
                    <TableCell>{song.recipient}</TableCell>
                    <TableCell>{song.genre}</TableCell>
                    <TableCell>{new Date(song.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {songs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No songs created yet. Click "Create New Song" to get started!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <PremiumPlanModal open={showPremiumPlanModal} onOpenChange={setShowPremiumPlanModal} />
    </div>
  );
}
