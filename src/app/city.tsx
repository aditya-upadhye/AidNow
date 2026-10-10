import { Redirect } from 'expo-router';

/** The City view is a section of the Community tab. */
export default function City() {
  return <Redirect href="/community?tab=city" />;
}
