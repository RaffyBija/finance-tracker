
export const verificationEmailTemplate = (verificationUrl: string) => `
<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifica il tuo account</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7; padding: 40px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 40px;">
            <tr>
              <td align="center" style="padding-bottom: 20px;">
                <h1 style="color: #2c3e50; font-size: 28px; margin: 0;">Benvenuto su Finance Tracker!</h1>
              </td>
            </tr>
            <tr>
              <td style="color: #555555; font-size: 16px; line-height: 24px; text-align: center; padding-bottom: 30px;">
                Grazie per esserti registrato. Clicca sul pulsante qui sotto per verificare il tuo account.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom: 30px;">
                <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; text-decoration: none; padding: 15px 25px; border-radius: 5px; display: inline-block; font-weight: bold;">Verifica il tuo account</a>
              </td>
            </tr>
            <tr>
              <td style="color: #888888; font-size: 14px; line-height: 20px; text-align: center;">
                Il link è valido per 24 ore.<br>
                Se non hai creato tu questo account, puoi ignorare questa email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

export const resetPasswordEmailTemplate = (resetUrl: string) => `
<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7; padding: 40px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 40px;">
            <tr>
              <td align="center" style="padding-bottom: 20px;">
                <h1 style="color: #2c3e50; font-size: 28px; margin: 0;">Reset Password</h1>
              </td>
            </tr>
            <tr>
              <td style="color: #555555; font-size: 16px; line-height: 24px; text-align: center; padding-bottom: 30px;">
                Abbiamo ricevuto una richiesta per reimpostare la tua password. Clicca sul pulsante qui sotto per procedere.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom: 30px;">
                <a href="${resetUrl}" style="background-color: #f39c12; color: white; text-decoration: none; padding: 15px 25px; border-radius: 5px; display: inline-block; font-weight: bold;">Reimposta la password</a>
              </td>
            </tr>
            <tr>
              <td style="color: #888888; font-size: 14px; line-height: 20px; text-align: center;">
                Il link è valido per 1 ora.<br>
                Se non hai richiesto tu il reset della password, puoi ignorare questa email.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top: 30px; font-size: 12px; color: #aaaaaa;">
                &copy; ${new Date().getFullYear()} Finance Tracker. Tutti i diritti riservati.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
