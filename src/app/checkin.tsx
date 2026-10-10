import { Redirect } from 'expo-router';

/** "Let family know" is the Family tab. */
export default function CheckIn() {
  return <Redirect href="/family" />;
}
