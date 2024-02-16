'use strict';
const router = require('express').Router();
const fetch = require('node-fetch');

const WhatsappCloudAPI = require('whatsappcloudapi_wrapper');
// const WhatsappAPI = require('whatsapp-business-api');
const Whatsapp = new WhatsappCloudAPI({
  accessToken: process.env.Meta_WA_accessToken,
  senderPhoneNumberId: process.env.Meta_WA_SenderPhoneNumberId,
  WABA_ID: process.env.Meta_WA_wabaId,
  graphAPIVersion: 'v14.0',
});

const botId = process.env.Meta_WA_SenderPhoneNumberId;
const bearerToken = process.env.Meta_WA_accessToken;

// const wp = new WhatsappAPI({
//   accountPhoneNumberId: process.env.Meta_WA_SenderPhoneNumberId, // required
//   accessToken: process.env.Meta_WA_accessToken, // required
// });

const EcommerceStore = require('./../utils/ecommerce_store.js');
let Store = new EcommerceStore();
let count = 0;
let optLst = [];
let flag = 0;
let pdf = 0;
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

    const callButtonMessage = {
      type: 'template',
      template: {
        name: 'call_action',
        language: {
          code: 'en_US',
          policy: 'deterministic',
        },
        components: [
          {
            type: 'button',
            sub_type: 'quick_reply',
            index: 1,
          },
        ],
      },
    };

    if (data?.isMessage) {
      let incomingMessage = data.message;
      let recipientPhone = incomingMessage.from.phone; // extract the phone number of sender
      let recipientName = incomingMessage.from.name;
      let typeOfMsg = incomingMessage.type; // extract the type of message (some are text, others are images, others are responses to buttons etc...)
      let message_id = incomingMessage.message_id; // extract the message id

      let phoneNbr = incomingMessage.from.phone;
      var url = ' https://graph.facebook.com/v17.0/' + botId + '/messages';

      let optionsCallButton = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: [phoneNbr],
        ...callButtonMessage,
      //   text: {
      //     body: 'Greeting From Vizz',
      // },
      };

    function optionsButtonPdfSend(recipientPhone, caption, URL) {
      let optionsCallButtonPdfSend = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: [recipientPhone],
        type: 'document',
        document: {
            caption: caption || '',
            link: URL,
            filename: caption || 'document'
        },
    };

    return optionsCallButtonPdfSend;
    }

      async function sendCallButton() {
        const postReq = {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + bearerToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(optionsCallButton),
          json: true,
        };

        fetch(url, postReq)
          .then((data) => {
            return data.json();
          })
          .then((res) => {
            console.log(res);
          })
          .catch((error) => console.log(error));
      }

      async function sendPDF(recipientPhone, caption, URL) {
        const postReq = {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + bearerToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(optionsButtonPdfSend(recipientPhone, caption, URL)),
          json: true,
        };

        fetch(url, postReq)
          .then((data) => {
            return data.json();
          })
          .then((res) => {
            console.log(res);
          })
          .catch((error) => console.log(error));
      }

      if (typeOfMsg === 'radio_button_message') {
        count++;
        console.log('>>>', count);
        if (count === 1) incomingMessage.option = count;
        if (count === 2) incomingMessage.option = count;
        if (count === 3) incomingMessage.option = count;
        if (count === 3) count = 0;

        if (count <= 2) {
          if (incomingMessage.option === 1) optLst[0] = incomingMessage.list_reply;
          if (incomingMessage.option === 2) optLst[1] = incomingMessage.list_reply;
          if (incomingMessage.option === 3) optLst[2] = incomingMessage.list_reply;
        }
      }

      if (typeOfMsg === 'text_message' || (typeOfMsg === 'simple_button_message' && incomingMessage.button_reply.id === 'go_back_main_menu')) {
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
            {
              title: 'Print my invoice',
              id: 'print_invoice',
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

          sendCallButton();

          // await Whatsapp.sendContact({
          //   recipientPhone: recipientPhone,
          //   contact_profile: {
          //     addresses: [
          //       {
          //         city: 'Nairobi',
          //         country: 'Kenya',
          //       },
          //     ],
          //     name: {
          //       first_name: 'Daggie',
          //       last_name: 'Blanqx',
          //     },
          //     org: {
          //       company: 'Mom-N-Pop Shop',
          //     },
          //     phones: [
          //       {
          //         phone: '+1 (555) 025-3483',
          //       },
          //       {
          //         phone: '+254712345678',
          //       },
          //     ],
          //   },
          // });
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


            //* PDF online link
            // await Whatsapp.sendDocument({
            //   recipientPhone: recipientPhone,
            //   caption: `PDF invoice #${recipientName}`,
            //   url: 'https://www.adobe.com/support/products/enterprise/knowledgecenter/media/c4611_sample_explain.pdf',
            // });

            let caption = `PDF invoice #${recipientName}`;
            let url = 'https://www.adobe.com/support/products/enterprise/knowledgecenter/media/c4611_sample_explain.pdf';

            await sendPDF(recipientPhone, caption, url)

            //* PDF generate in local
            // Store.generatePDFInvoice({
            //   order_details: invoiceText + productInvoice,
            //   file_path: `./invoice_${recipientName}${++pdf}.pdf`,
            // });

            //* Send Stored PDF
            // await Whatsapp.sendDocument({
            //   recipientPhone: recipientPhone,
            //   caption: `PDF invoice #${recipientName}`,
            //   file_path: './public/Profile.pdf',
            // });

            // * Send the location of our pickup station to the customer, so they can come and pick up their order

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
              title: 'Max Capacity',
              rows: [
                {
                  id: 1,
                  title: 1,
                  description: 'Load value 1'
                },
                {
                  id: 2,
                  title: 2,
                  description:'Load value 2',
                }
              ]
            }
          ];
          
          await Whatsapp.sendText({
            recipientPhone: recipientPhone,
            message: 'Next you will be required to select Max Load, Max Speed ad Max Watt one by one as the option list pops up'
          });

          await new Promise((resolve) => setTimeout(resolve, 3000));

          await Whatsapp.sendRadioButtons({
            recipientPhone: recipientPhone,
            headerText: 'Select the Max passenger Capacity :',
            //headerText: `#Offers: ${selectedCategory}`,
            bodyText: `1> Select any option:`,
            footerText: 'Max Passenger Capacity',
            listOfSections: listOfSections1,
          });
        }
      }

      if (optLst.length === 1 && typeOfMsg === 'radio_button_message') {
        let listOfProducts = await Store.getProductsInCategory('jewelery');
        let listOfSections2 = [
          {
            title: 'MAx Speed',
            rows: [
            {
              id: 1,
              title: 1,
              description: 'Speed value 1'
            },
            {
              id: 2,
              title: 2,
              description:'Speed value 2',
            }
            ]
          }
        ]

        await Whatsapp.sendRadioButtons({
          recipientPhone: recipientPhone,
          headerText: 'Select the Max Speed :',
          bodyText: `2> Select any option:`,
          footerText: 'Max Speed m/s',
          listOfSections: listOfSections2,
        });
      }

      if (optLst.length === 2 && typeOfMsg === 'radio_button_message') {
        let listOfProducts = await Store.getProductsInCategory('jewelery');
        let listOfSections2 = [
          {
            title: 'MAx Wattage',
            rows: [
              {
                id: 1,
                title: 1,
                description: 'Watt value 1'
              },
              {
                id: 2,
                title: 2,
                description:'Watt value 2',
              }
            ]
          },
        ];

        await Whatsapp.sendRadioButtons({
          recipientPhone: recipientPhone,
          headerText: 'Select the Max Watt :',
          bodyText: `3> Select any option:`,
          footerText: 'Max Watt',
          listOfSections: listOfSections2,
        });
      }

      console.log('>>>', optLst);

      if (optLst.length === 3) {
        console.log('>>> IN', optLst);

        let selectionId = incomingMessage.list_reply.id; // the customer clicked and submitted a radio button

        if (selectionId.startsWith('product_')) {
          let product_id = selectionId.split('_')[1];
          let productImg = [];

          let product = await Store.getProductById(product_id);
          const { price, title, description, category, image: imageUrl, rating } = product.data;

          // await Promise.all(
          //   optLst.map(async (i) => {
          //     let product_1 = await Store.getProductById(i.id.split('_')[1]);
          //     await productImg.push(product_1?.data?.image);
          //   })
          // );

          // console.log(productImg);

          // let emojiRating = (rvalue) => {
          //   rvalue = Math.floor(rvalue || 0); // generate as many star emojis as whole number ratings
          //   let output = [];
          //   for (var i = 0; i < rvalue; i++) output.push('⭐');
          //   return output.length ? output.join('') : 'N/A';
          // };

          let text = `Your Selection are \n\n >> ${optLst[0]?.title} \n >>> ${optLst[1]?.title} \n >>> ${optLst[2]?.title}`;

          console.log('>>> IN', text);

          // let text = `_Title_: *${title.trim()}*\n\n\n`;
          // text += `_Description_: ${description.trim()}\n\n\n`;
          // text += `_Price_: $${price}\n`;
          // text += `_Category_: ${category}\n`;
          // text += `${rating?.count || 0} shoppers liked this product.\n`;
          // text += `_Rated_: ${emojiRating(rating?.rate)}\n`;

          // await Whatsapp.sendImage({
            // recipientPhone,
            // url: productImg[0],
          //   caption: text,
          // });

          await Whatsapp.sendText({
              recipientPhone: recipientPhone,
              message: text
            });

          // Add a small delay (optional, but it helps group the messages)
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // await Whatsapp.sendImage({
          //   recipientPhone,
          //   url: productImg[1],
          // });

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
        let text = `Your Selection are \n\n >> ${optLst[0]?.description} \n >>> ${optLst[1]?.description} \n >>> ${optLst[2]?.description}`;
        await Whatsapp.sendText({
          recipientPhone: recipientPhone,
          message: text
        });
        await Whatsapp.sendSimpleButtons({
          message: `Go back to main menu`,
          recipientPhone: recipientPhone,
          listOfButtons: [
            {
              title: 'Main manu',
              id: `go_back_main_menu`,
            },
          ],
        });

        optLst = [];
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
