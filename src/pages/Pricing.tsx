import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";

export default function Pricing() {
  const { toast } = useToast();
  const plans = [
    {
      name: "Basic",
      price: "₹499",
      songs: 5,
      features: ["5 Songs", "Standard Quality", "Email Support"],
      description: "Perfect for beginners starting their musical journey",
      color: "from-blue-400 to-blue-600"
    },
    {
      name: "Premium",
      price: "₹999",
      songs: 15,
      features: ["15 Songs", "High Quality", "Priority Support", "Custom Requests"],
      description: "Ideal for music enthusiasts and semi-professionals",
      color: "from-purple-400 to-pink-600",
      popular: true
    },
    {
      name: "Professional",
      price: "₹1999",
      songs: -1,
      features: [
        "Unlimited Songs",
        "Highest Quality",
        "24/7 Support",
        "Custom Requests",
        "Commercial License",
      ],
      description: "For professional musicians and commercial use",
      color: "from-amber-400 to-orange-600"
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
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          Choose Your Plan
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          Select a plan that best fits your needs
        </p>
      </div>

      <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-x-8">
        {plans.map((plan) => (
          <Card key={plan.name} className={`relative flex flex-col rounded-2xl border p-8 shadow-lg ${plan.popular ? 'border-purple-500 ring-2 ring-purple-500' : ''}`}>
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="inline-flex rounded-full bg-purple-100 px-4 py-1 text-sm font-semibold text-purple-600">
                  Most Popular
                </span>
              </div>
            )}
            
            <div className="mb-5">
              <h3 className={`text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${plan.color}`}>
                {plan.name}
              </h3>
              <div className="mt-4 flex items-baseline text-gray-900">
                <span className="text-5xl font-extrabold tracking-tight">{plan.price}</span>
                <span className="ml-1 text-xl font-semibold">/month</span>
              </div>
              <p className="mt-2 text-gray-500">{plan.description}</p>
            </div>

            <ul className="mb-8 space-y-4 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center">
                  <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="ml-3 text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <Button 
              className={`w-full bg-gradient-to-r ${plan.color} text-white hover:opacity-90`}
              onClick={() => handleSubscribe(plan)}
            >
              Get Started
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
