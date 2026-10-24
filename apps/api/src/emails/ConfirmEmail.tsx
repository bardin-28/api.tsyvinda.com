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

export interface ConfirmEmailProps {
  firstName: string;
  url: string;
}

export function ConfirmEmail({ firstName, url }: ConfirmEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Confirm your email to activate your account</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Confirm your email</Heading>
          <Text style={styles.paragraph}>
            Hi {firstName}, confirm your email address to finish setting up your account.
          </Text>
          <Button href={url} style={styles.button}>
            Confirm email
          </Button>
          <Text style={styles.mutedParagraph}>
            If the button does not work, paste this URL into your browser:
            <br />
            <Link href={url} style={styles.link}>
              {url}
            </Link>
          </Text>
          <Text style={styles.mutedParagraph}>This link expires in 24 hours.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ConfirmEmail;
