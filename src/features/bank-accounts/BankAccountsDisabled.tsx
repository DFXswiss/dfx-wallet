import { Redirect } from 'expo-router';

export default function BankAccountsDisabled() {
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
