'use strict';
const router = require('express').Router();

const WhatsappCloudAPI = require('whatsappcloudapi_wrapper');
const Whatsapp = new WhatsappCloudAPI({
  accessToken: process.env.Meta_WA_accessToken,
  senderPhoneNumberId: process.env.Meta_WA_SenderPhoneNumberId,
  WABA_ID: process.env.Meta_WA_wabaId,
  graphAPIVersion: 'v14.0',
});

const EcommerceStore = require('./../utils/ecommerce_store.js');
let Store = new EcommerceStore();
let count = 0;
let optLst = [];
let flag = 0;
const CustomerSession = new Map();

router.get('/meta_wa_callbackurl', (req, res) => {
  try {
    console.log('GET: Someone is pinging me!');

    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if (mode && token && mode === 'subscribe' && process.env.Meta_WA_VerifyToken === token) {
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  } catch (error) {
    console.error({ error });
    return res.sendStatus(500);
  }
});

router.post('/meta_wa_callbackurl', async (req, res) => {
  try {
    let data = Whatsapp.parseMessage(req.body);

    if (data?.isMessage) {
      let incomingMessage = data.message;
      let recipientPhone = incomingMessage.from.phone; // extract the phone number of sender
      let recipientName = incomingMessage.from.name;
      let typeOfMsg = incomingMessage.type; // extract the type of message (some are text, others are images, others are responses to buttons etc...)
      let message_id = incomingMessage.message_id; // extract the message id

      if (typeOfMsg === 'radio_button_message') {
        count++;
        console.log('>>>', count);
        if (count === 1) incomingMessage.option = count;
        if (count === 2) incomingMessage.option = count;
        if (count === 2) count = 0;

        if (count <= 2) {
          if (incomingMessage.option === 1) optLst[0] = incomingMessage.list_reply;
          if (incomingMessage.option === 2) optLst[1] = incomingMessage.list_reply;
        }
      }

      if (typeOfMsg === 'text_message') {
        await Whatsapp.sendSimpleButtons({
          message: `Hey ${recipientName}, \nYou are speaking to a chatbot.\nWhat do you want to do next?`,
          recipientPhone: recipientPhone,
          listOfButtons: [
            {
              title: 'View some products',
              id: 'see_categories',
            },
            {
              title: 'Speak to a human',
              id: 'speak_to_human',
            },
          ],
        });
      }

      if (typeOfMsg === 'simple_button_message') {
        let button_id = incomingMessage.button_reply.id;

        if (button_id === 'speak_to_human') {
          await Whatsapp.sendText({
            recipientPhone: recipientPhone,
            message: `Arguably, chatbots are faster than humans.\nCall my human with the below details:`,
          });

          await Whatsapp.sendContact({
            recipientPhone: recipientPhone,
            contact_profile: {
              addresses: [
                {
                  city: 'Nairobi',
                  country: 'Kenya',
                },
              ],
              name: {
                first_name: 'Daggie',
                last_name: 'Blanqx',
              },
              org: {
                company: 'Mom-N-Pop Shop',
              },
              phones: [
                {
                  phone: '+1 (555) 025-3483',
                },
                {
                  phone: '+254712345678',
                },
              ],
            },
          });
        }

        if (button_id === 'see_categories') {
          let categories = await Store.getAllCategories();
          optLst = [];
          await Whatsapp.sendSimpleButtons({
            message: `We have several categories.\nChoose one of them.`,
            recipientPhone: recipientPhone,
            listOfButtons: categories.data
              .map((category) => ({
                title: category,
                id: `category_${category}`,
              }))
              .slice(0, 3),
          });
        }

        // -------------------------INVOPICE PDF PRINT

        if (button_id === 'print_invoice') {
          try {
            let productInvoice = '';
            let invoiceText = `List of items in your cart:\n\n\n`;

            await optLst.map((i) => {
              productInvoice += `${i.title}*\n ${i.description}*\n\n\n`;
            });

            let text = `${invoiceText}/n/n/n`;
            text += `${productInvoice}`;

            console.log('>>>>productInvoice', productInvoice);

            Store.generatePDFInvoice({
              order_details: invoiceText + productInvoice,
              file_path: `./invoice_${recipientName}.pdf`,
            });

            // Send the PDF invoice

            // Send Created PDF
            await Whatsapp.sendDocument({
              recipientPhone: recipientPhone,
              caption: `PDF invoice #${recipientName}`,
              file_path: `./invoice_${recipientName}.pdf`,
            });

            // Send Stored PDF
            await Whatsapp.sendDocument({
              recipientPhone: recipientPhone,
              caption: `PDF invoice #${recipientName}`,
              file_path: './public/Profile.pdf',
            });

            // Send the location of our pickup station to the customer, so they can come and pick up their order
            // let warehouse = Store.generateRandomGeoLocation();

            // await Whatsapp.sendText({
            //   recipientPhone: recipientPhone,
            //   message: `Your order has been fulfilled. Come and pick it up, as you pay, here:`,
            // });

            //   await Whatsapp.sendLocation({
            //     recipientPhone,
            //     latitude: warehouse.latitude,
            //     longitude: warehouse.longitude,
            //     address: warehouse.address,
            //     name: 'Mom-N-Pop Shop',
            // });
            await Whatsapp.sendSimpleButtons({
              message: `what do you want to do next?`,
              recipientPhone: recipientPhone,
              listOfButtons: [
                {
                  title: 'See more products',
                  id: 'see_categories',
                },
              ],
            });
            optLst = [];
          } catch (error) {
            console.log('>>>', error);
          }
        }

        if (button_id.startsWith('category_')) {
          let selectedCategory = button_id.split('category_')[1];
          let listOfProducts = await Store.getProductsInCategory(selectedCategory);

          let listOfSections1 = [
            {
              title: `🏆 Top 3: ${selectedCategory}`.substring(0, 24),
              rows: listOfProducts.data
                .map((product) => {
                  let id = `product_${product.id}`.substring(0, 256);
                  let title = product.title.substring(0, 21);
                  let description = `${product.price}\n${product.description}`.substring(0, 68);

                  return {
                    id,
                    title: `${title}...`,
                    description: `$${description}...`,
                  };
                })
                .slice(0, 10),
            },
          ];

          await Whatsapp.sendRadioButtons({
            recipientPhone: recipientPhone,
            headerText: `#Offers: ${selectedCategory}`,
            bodyText: `1> Select any option:`,
            footerText: 'XYZ',
            listOfSections: listOfSections1,
          });
        }
      }

      if (optLst.length === 1 && typeOfMsg === 'radio_button_message') {
        let listOfProducts = await Store.getProductsInCategory('jewelery');
        let listOfSections2 = [
          {
            title: `🏆 Top 3: Product`.substring(0, 24),
            rows: listOfProducts.data
              .map((product) => {
                let id = `product_${product.id}`.substring(0, 256);
                let title = product.title.substring(0, 21);
                let description = `${product.price}\n${product.description}`.substring(0, 68);

                return {
                  id,
                  title: `${title}...`,
                  description: `$${description}...`,
                };
              })
              .slice(0, 10),
          },
        ];

        await Whatsapp.sendRadioButtons({
          recipientPhone: recipientPhone,
          headerText: `#Offers:`,
          bodyText: `2> Select any option:`,
          footerText: 'XYZ',
          listOfSections: listOfSections2,
        });
      }

      console.log('>>>', optLst);

      if (optLst.length === 2) {
        console.log('>>>', optLst);

        let selectionId = incomingMessage.list_reply.id; // the customer clicked and submitted a radio button

        if (selectionId.startsWith('product_')) {
          let product_id = selectionId.split('_')[1];
          let productImg = [];

          let product = await Store.getProductById(product_id);
          const { price, title, description, category, image: imageUrl, rating } = product.data;

          await Promise.all(
            optLst.map(async (i) => {
              let product_1 = await Store.getProductById(i.id.split('_')[1]);
              await productImg.push(product_1?.data?.image);
            })
          );

          console.log(productImg);

          let emojiRating = (rvalue) => {
            rvalue = Math.floor(rvalue || 0); // generate as many star emojis as whole number ratings
            let output = [];
            for (var i = 0; i < rvalue; i++) output.push('⭐');
            return output.length ? output.join('') : 'N/A';
          };

          let text = `Your Selection are \n\n >> ${optLst[0]?.title} \n >>> ${optLst[1]?.title}`;

          // let text = `_Title_: *${title.trim()}*\n\n\n`;
          // text += `_Description_: ${description.trim()}\n\n\n`;
          // text += `_Price_: $${price}\n`;
          // text += `_Category_: ${category}\n`;
          // text += `${rating?.count || 0} shoppers liked this product.\n`;
          // text += `_Rated_: ${emojiRating(rating?.rate)}\n`;

          await Whatsapp.sendImage({
            recipientPhone,
            url: productImg[0],
            caption: text,
          });

          // Add a small delay (optional, but it helps group the messages)
          await new Promise((resolve) => setTimeout(resolve, 1000));

          await Whatsapp.sendImage({
            recipientPhone,
            url: productImg[1],
          });

          // Add a small delay (optional, but it helps group the messages)
          await new Promise((resolve) => setTimeout(resolve, 1000));

          await Whatsapp.sendSimpleButtons({
            message: `Here is the product, what do you want to do next?`,
            recipientPhone: recipientPhone,
            listOfButtons: [
              {
                title: 'Add to cart🛒',
                id: `add_to_cart_${product_id}`,
              },
              {
                title: 'Print my invoice',
                id: 'print_invoice',
              },
              // {
              //   title: 'See more products',
              //   id: 'see_categories',
              // },
            ],
          });
        }
        // optLst = [];
      }

      // message read blue tick
      await Whatsapp.markMessageAsRead({
        message_id: message_id,
      });
    }
    console.log('POST: Someone is pinging me!');
    return res.sendStatus(200);
  } catch (error) {
    console.error({ error });
    return res.sendStatus(500);
  }
});
module.exports = router;
