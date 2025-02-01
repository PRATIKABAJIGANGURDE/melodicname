import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";

interface PremiumPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PremiumPlanModal({ open, onOpenChange }: PremiumPlanModalProps) {
  const { toast } = useToast();
  const plans = [
    {
      name: "Basic",
      price: "₹499",
      songs: 5,
      features: ["5 Songs", "Standard Quality", "Email Support"],
    },
    {
      name: "Premium",
      price: "₹999",
      songs: 15,
      features: ["15 Songs", "High Quality", "Priority Support", "Custom Requests"],
    },
    {
      name: "Professional",
      price: "₹1999",
      songs: -1, // -1 means unlimited
      features: [
        "Unlimited Songs",
        "Highest Quality",
        "24/7 Support",
        "Custom Requests",
        "Commercial License",
      ],
    },
  ];

  const handleSubscribe = async (plan: typeof plans[0]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "Please log in to subscribe",
          variant: "destructive",
        });
        return;
      }

      // Update user profile with new plan
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          is_premium: true,
          free_songs_remaining: plan.songs
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `You've been upgraded to ${plan.name} plan!`,
      });

      // Close the modal
      onOpenChange(false);

      // Refresh the page to update UI
      window.location.reload();

    } catch (error) {
      console.error('Error subscribing:', error);
      toast({
        title: "Error",
        description: "Failed to process subscription. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            Upgrade to Premium
          </DialogTitle>
          <DialogDescription>
            Choose a plan that works best for you
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          {plans.map((plan) => (
            <Card key={plan.name} className="p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="text-3xl font-bold">{plan.price}</p>
                <p className="text-sm text-muted-foreground">
                  {plan.songs === -1 ? "Unlimited" : plan.songs} Songs
                </p>
              </div>
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center space-x-2">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                onClick={() => handleSubscribe(plan)}
              >
                Subscribe Now
              </Button>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
