import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components';
import * as styles from './welcome-email.styles';

export interface WelcomeEmailProps {
  username: string;
  appUrl?: string;
}

const DEFAULT_APP_URL = 'https://tsyvinda.com';

export function WelcomeEmail({ username, appUrl = DEFAULT_APP_URL }: WelcomeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome aboard, {username}!</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Welcome, {username}!</Heading>
          <Text style={styles.paragraph}>
            Thanks for signing up. We&apos;re glad to have you on board — your account is ready to
            use.
          </Text>
          <Button href={appUrl} style={styles.button}>
            Get started
          </Button>
        </Container>
      </Body>
    </Html>
  );
}

export default WelcomeEmail;
