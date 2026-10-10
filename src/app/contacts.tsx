import { Redirect } from 'expo-router';

/** Emergency contacts now live in the Family tab. Kept so old links and buttons still land in the right place. */
export default function Contacts() {
  return <Redirect href="/family" />;
}
