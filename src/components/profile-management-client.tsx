
"use client";

import React, { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { updateUserProfile } from '@/services/user-service';
import type { User } from '@/lib/types';
import { Eye, EyeOff } from 'lucide-react';
import { Separator } from './ui/separator';

const profileSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required to make changes.'),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
  pin: z.string().regex(/^\d{4}$|/, 'PIN must be 4 digits').optional(),
}).refine(data => {
    if (data.newPassword || data.confirmPassword) {
        return data.newPassword === data.confirmPassword;
    }
    return true;
}, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
}).refine(data => {
    if (data.newPassword) {
        return data.newPassword.length >= 6;
    }
    return true;
}, {
    message: "New password must be at least 6 characters.",
    path: ["newPassword"],
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileManagementClientProps {
    currentUser: User;
}

export function ProfileManagementClient({ currentUser }: ProfileManagementClientProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const { toast } = useToast();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      pin: currentUser.pin || '',
    },
  });
  
  const canChangePin = currentUser.role === 'Supervisor' || currentUser.role === 'Owner' || currentUser.role === 'Admin';

  const onSubmit: SubmitHandler<ProfileFormValues> = async (data) => {
    setIsSubmitting(true);
    try {
        await updateUserProfile({
            userId: currentUser.id,
            currentPassword: data.currentPassword,
            newPassword: data.newPassword,
            pin: data.pin,
        });

        toast({
            title: 'Profile Updated',
            description: 'Your changes have been saved successfully.',
        });
        
        form.reset({
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
            pin: data.pin, // Keep the updated PIN in the form
        });

    } catch (error) {
      console.error('Error updating profile:', error);
      let errorMessage = 'An unexpected error occurred.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
        <div>
            <h1 className="text-3xl font-bold">Manage Profile</h1>
            <p className="text-muted-foreground">Update your account password and PIN.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Enter your current password to make changes.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="currentPassword"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Current Password</FormLabel>
                                <div className="relative">
                                <FormControl>
                                    <Input type={showCurrentPassword ? 'text' : 'password'} {...field} autoComplete="off" />
                                </FormControl>
                                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground">
                                    {showCurrentPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                                </button>
                                </div>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        
                        <Separator />

                        <FormField
                            control={form.control}
                            name="newPassword"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>New Password</FormLabel>
                                <div className="relative">
                                <FormControl>
                                    <Input type={showNewPassword ? 'text' : 'password'} placeholder="Leave blank to keep current" {...field} autoComplete="new-password" />
                                </FormControl>
                                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground">
                                    {showNewPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                                </button>
                                </div>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                         <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Confirm New Password</FormLabel>
                                <FormControl>
                                    <Input type={showNewPassword ? 'text' : 'password'} placeholder="Confirm your new password" {...field} autoComplete="new-password" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                        {canChangePin && (
                            <>
                                <Separator />
                                <FormField
                                    control={form.control}
                                    name="pin"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>PIN Code</FormLabel>
                                        <FormControl><Input type="password" maxLength={4} {...field} autoComplete="off" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </>
                        )}
                        
                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  );
}
