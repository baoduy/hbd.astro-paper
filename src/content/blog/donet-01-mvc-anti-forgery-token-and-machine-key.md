---
author: Steven Hoang
pubDatetime: 2017-02-14T00:00:00Z
title: "Anti Forgery Token and Machine Key for MVC on IIS"
postSlug: anti-forgery-token-and-machine-key-aspnet-mvc-iis
featured: false
draft: false
tags:
  - dotnet
  - MVC
  - web-farm
  - iis
ogImage: ""
description:
  The Medium post explains the importance of anti-forgery tokens and machine keys in web application security against CSRF attacks.
  It provides implementation details for ASP.NET, including the use of AntiForgeryToken and configuring the machine key.
  The post emphasizes the necessity of implementing both measures to enhance overall security.
---

If you're developing using ASP.NET MVC, it's highly likely that you've come across the concept of anti-forgery tokens.
These tokens play a critical role in bolstering the security of our web applications and safeguarding them against Cross-Site Request Forgery (CSRF) attacks.

In this attack vector, unauthorized commands are transmitted from a user that the website trusts.
CSRF attacks exploit the trust that a site has for a user, and
the anti-forgery token mitigates this by ensuring that the unauthorized commands do not execute.

To leverage this security feature in your ASP.NET MVC application, two key steps are involved:

1. Implement the `AntiForgeryToken` method directly within the form you wish to protect.
   This method generates the token that will be validated upon form submission.

```csharp
@using (Html.BeginForm())
{
    @Html.AntiForgeryToken()
    ....
}
```

2. Adorn the corresponding action method in your controller with the ValidateAntiForgeryToken attribute.
   This ensures that the ASP.NET MVC framework validates the token included in the request against the token stored in the form body.

```csharp
[HttpPost]
[ValidateAntiForgeryToken]
public ActionResult Create(FormCollection collection)
{
    ...
}
```

## How does it work?

When utilizing the `AntiForgeryToken` method within a form, ASP.NET generates an encrypted `AntiForgeryToken`.
This token is placed into a hidden field and then transmitted to the client browser.
Upon submitting the form back to the server, this token is decrypted and validated to confirm the authenticity of the request.
Only upon successful validation will the targeted action method be executed.
However, this validation occurs only if the action method is adorned with the `ValidateAntiForgeryTokenAttribute`.

The generated token structure resembles:

```html
<form action="Create" method="post">
  <input
    name="__RequestVerificationToken"
    type="hidden"
    value="Kw1D9Co5OuHbp2TajfwB2xdR-lABEkjtwwMs0tLr9K8Y-dycbbRQU904HljeF4rBu0DnMpZpCtf1TrAoGmgnMxpeapzJtdR-P0BC3wuAc1-ZaHGSnYeEKoTa9fbMUOFx0"
  />
</form>
```

## What is the issue?

While deploying your website in an environment comprising multiple load-balanced servers (aka a web farm),
you may encounter the following issue when clicking the `submit` button:

> The anti-forgery token could not be decrypted.
> If this application is hosted by a Web Farm or cluster,
> ensure that all machines are running the same version of ASP.NET Web Pages
> and that the configuration specifies explicit encryption and validation keys.
> AutoGenerate cannot be used in a cluster.

## Why did this issue happen?

Consider a setup where the environment consists of two servers performing load balancing as illustrated in the given diagram:
![Request-Diagram.png](/assets/donet-mvc-anti-forgery-token-and-machine-key/Request-Diagram.png)

In this setup, the ASP.NET application utilizes two unique keys (decryptionKey and validationKey) for token encryption/decryption and token validation.
By default, these keys are randomly generated each time the website starts.

In our diagram, we have two instances of the same website hosted on different servers forming a single web farm.
When the website starts on both servers, two different sets of keys are independently generated for each instance.

Let's say a user, denoted here as user A, sends a request that is redirected to server 1 by the load balancer.
The website responds by providing a view along with an encrypted AntiForgeryToken.
Later user A submits the form back to the load balancer, expecting the form to be processed by server 1.

However, if the load balancer redirects the request to server 2, there’s a problem.
The token encrypted by Server 1 cannot be decrypted on Server 2 as the decryptionKey on Server 2 differs from the one on Server 1.
This mismatch of keys results in an error.

To prevent such issues, ensure consistency in keys for every instance of the website inside a single web farm
needs to use the same set of keys for token encryption/decryption and validation.

However, when dealing with multiple websites hosted on the same server,
these keys need to be unique for each website. Similarly, when the same website is hosted in multiple environments,
the keys employed in each environment should be different.
This is to maintain the secure and independent identity of each website and environment.

## The solution for IIS

The goal is to establish a mechanism to share a set of keys across multiple servers within a single farm.
This will ensure successful encryption and decryption regardless of the server performing the task.

For an AspNet MVC website hosted on IIS, a set of keys can be generated following these steps:

1. Select the website on IIS.
2. Double-click on "Machine Key."
3. De-select all checkboxes, click on the "Generate" button on the right side, and then hit "Apply."

![IIS-machine-key-settings](/assets/donet-mvc-anti-forgery-token-and-machine-key/IIS-machine-key.png)

Once generated, the keys are saved in the "web.config" file of the website.
You can distribute these keys to all website instances on all the servers in the farm as follows:

1. Open the "web.config" file and locate the keys,
2. Copy these keys and distribute them across all website instances within the farm.

```xml
<system.web>
    <machineKey decryptionKey="13C9825F6B5ABB0622CF09B6C7F949F83D113B3CC2351438"
                validationKey="DA39AFED706512A688EDD4FA5898FABF2D8A0D6897465093B1237C1D46E34F8E7B0E9A09FFE647CAC32DEFE9AFAEDDE6EFE8FF6CDE0BF27C883277BB3566BFA6" />
 </system.web>
```

After accomplishing this, try submitting your website again. These measures should resolve the initial issue.

<hr/>
Thank you for your time! If you have any further questions, feel free to ask. 🌟✨🎁

Steven
[GitHub](<[https://github.com/baoduy](https://github.com/baoduy)>)
