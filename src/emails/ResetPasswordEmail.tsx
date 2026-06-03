import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components';
import * as styles from './welcome-email.styles';

export interface ResetPasswordEmailProps {
  firstName: string;
  url: string;
}

export function ResetPasswordEmail({ firstName, url }: ResetPasswordEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Reset your password</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Reset your password</Heading>
          <Text style={styles.paragraph}>
            Hi {firstName}, we received a request to reset your password. Click the button below to
            choose a new one. If you did not make this request, you can safely ignore this email.
          </Text>
          <Button href={url} style={styles.button}>
            Reset password
          </Button>
          <Text style={styles.mutedParagraph}>
            If the button does not work, paste this URL into your browser:
            <br />
            <Link href={url} style={styles.link}>
              {url}
            </Link>
          </Text>
          <Text style={styles.mutedParagraph}>This link expires in 1 hour.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ResetPasswordEmail;
