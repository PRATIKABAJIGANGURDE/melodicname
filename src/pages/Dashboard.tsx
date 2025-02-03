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

  const handleSongReceived = async (songId: string) => {
    try {
      const { error } = await supabase
        .from('song_requests')
        .update({ 
          status: 'completed'
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
              <Button variant="outline" className="w-full mt-4">
                Upgrade to Premium
              </Button>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {songs.map((song) => (
                  <TableRow key={song.id}>
                    <TableCell>{song.song_name}</TableCell>
                    <TableCell>{song.recipient}</TableCell>
                    <TableCell>{song.genre}</TableCell>
                    <TableCell className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        song.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {song.status}
                      </span>
                      {song.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSongReceived(song.id)}
                          className="h-6 px-2 text-xs font-medium"
                        >
                          ✓ Received
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>{new Date(song.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {songs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No songs created yet. Click "Create New Song" to get started!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
